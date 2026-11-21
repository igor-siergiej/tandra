import { readFile, stat } from 'node:fs/promises';

interface ProcessOwner {
    bootId: string;
    namespace: string;
    pid: number;
    startTime: string;
}

const namespaceId = async (path: string): Promise<string> => {
    const info = await stat(path, { bigint: true });

    return `${info.dev}:${info.ino}`;
};

const readProcess = async (path: string) => {
    const text = await readFile(path, 'utf8');
    // comm is parenthesized but may itself contain spaces and parentheses.
    const end = text.lastIndexOf(') ');

    const fields = text
        .slice(end + 2)
        .trim()
        .split(/\s+/);

    const pid = Number(text.slice(0, text.indexOf(' ')));
    const startTime = fields[19]; // /proc/<pid>/stat field 22, measured since this boot.

    if (end < 0 || !Number.isSafeInteger(pid) || pid <= 0 || !startTime || !/^\d+$/.test(startTime)) {
        throw new Error('Cannot identify request barrier process');
    }

    return { pid, startTime, state: fields[0] };
};

let localOwner: Promise<ProcessOwner | null> | undefined;

const identifyProcess = async (): Promise<ProcessOwner | null> => {
    if (process.platform !== 'linux') return null;

    try {
        const [bootId, namespace, status, ownProcess] = await Promise.all([
            readFile('/proc/sys/kernel/random/boot_id', 'utf8'),
            namespaceId('/proc/self/ns/pid'),
            readFile('/proc/self/status', 'utf8'),
            readProcess('/proc/self/stat'),
        ]);

        const namespacePids = /^NSpid:[ \t]+([0-9 \t]+)$/m
            .exec(status)?.[1]
            ?.trim()
            .split(/[ \t]+/);

        // NSpid lists IDs from the procfs mount's namespace inward. Multiple IDs mean this mount
        // belongs to a parent namespace and its numeric PID lookups cannot identify our holders.
        if (
            namespacePids?.length !== 1 ||
            Number(namespacePids[0]) !== process.pid ||
            ownProcess.pid !== process.pid ||
            !bootId.trim()
        ) {
            return null;
        }

        return { bootId: bootId.trim(), namespace, pid: ownProcess.pid, startTime: ownProcess.startTime };
    } catch {
        // Unsupported/restricted procfs must reduce availability, never weaken the fence.
        return null;
    }
};

export const createRequestToken = async (): Promise<string> =>
    JSON.stringify({ id: crypto.randomUUID(), owner: await (localOwner ??= identifyProcess()) });

export const isDeadRequestToken = async (token: string): Promise<boolean> => {
    let owner: ProcessOwner;

    try {
        const parsed = JSON.parse(token) as { owner?: Partial<ProcessOwner> } | null;
        const candidate = parsed?.owner;

        if (
            !candidate ||
            typeof candidate.bootId !== 'string' ||
            typeof candidate.namespace !== 'string' ||
            typeof candidate.pid !== 'number' ||
            !Number.isSafeInteger(candidate.pid) ||
            candidate.pid <= 0 ||
            typeof candidate.startTime !== 'string'
        ) {
            return false;
        }

        owner = candidate as ProcessOwner;
    } catch {
        // Tokens written before process ownership was introduced remain failclosed.
        return false;
    }

    const local = await identifyProcess();

    if (!local || owner.bootId !== local.bootId || owner.namespace !== local.namespace) return false;

    try {
        const current = await readProcess(`/proc/${owner.pid}/stat`);

        // PID reuse proves the original process exited. Stopped/suspended processes are still live.
        return current.startTime !== owner.startTime || ['Z', 'X', 'x'].includes(current.state ?? '');
    } catch (error) {
        // A hidden/unmounted procfs path is not proof of death. ESRCH comes from the kernel's
        // PID lookup in our verified namespace; EPERM and every other error remain failclosed.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false;

        try {
            process.kill(owner.pid, 0);

            return false;
        } catch (probeError) {
            return (probeError as NodeJS.ErrnoException).code === 'ESRCH';
        }
    }
};
