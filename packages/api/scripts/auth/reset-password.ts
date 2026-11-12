/**
 * Sets a new password for a Tandra user and signs them out of every device.
 * There is no email, so this is the only way back in for someone who forgot their password.
 *
 *   bun run auth:reset-password <username>                      (prompts, input hidden)
 *   printf '%s' "$PW" | bun run auth:reset-password <username> --password-stdin
 *
 * Uses the usual CONNECTION_URI / DATABASE_NAME / BETTER_AUTH_SECRET / BETTER_AUTH_URL.
 */
import { dependencyContainer, registerDepdendencies } from '../../src/dependencies';
import { DependencyToken } from '../../src/dependencies/types';
import { resetPassword } from './lib';

const fromStdin = process.argv.includes('--password-stdin');
const username = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

if (!username) {
    console.error('Usage: bun run auth:reset-password <username> [--password-stdin]');
    process.exit(1);
}

const readPiped = async () => (await new Response(Bun.stdin.stream()).text()).replace(/\r?\n$/, '');

// Reads one line from the terminal without echoing it (`prompt()` would echo the password).
const readHidden = (label: string) =>
    new Promise<string>((resolve, reject) => {
        const { stdin, stdout } = process;

        if (!stdin.isTTY) {
            reject(new Error('No terminal to prompt on; pipe the password in with --password-stdin'));

            return;
        }

        stdout.write(label);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        let value = '';

        const finish = (error?: Error) => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.off('data', onData);
            stdout.write('\n');

            if (error) reject(error);
            else resolve(value);
        };

        const onData = (chunk: string) => {
            for (const char of chunk) {
                if (char === '\r' || char === '\n') return finish();

                if (char === '\u0003') return finish(new Error('Cancelled'));

                if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
                else value += char;
            }
        };

        stdin.on('data', onData);
    });

const readPassword = async () => {
    if (fromStdin) return readPiped();
    const first = await readHidden('New password: ');

    if (first !== (await readHidden('Repeat it: '))) throw new Error('Passwords do not match');

    return first;
};

try {
    const password = await readPassword();
    registerDepdendencies();
    await resetPassword(dependencyContainer.resolve(DependencyToken.Auth), username, password);
    console.log(`Password reset for ${username}; their existing sessions are signed out.`);
    process.exit(0);
} catch (error) {
    console.error((error as Error).message);
    process.exit(1);
}
