/**
 * A throwaway S3-compatible server in memory, for the e2e stack's BUCKET_ENDPOINT (localhost:9000). CI starts no
 * RustFS, and flows that call the bucket (account erasure lists and removes the user's files) would otherwise fail
 * on a refused connection. Covers the calls the minio client makes: bucket probe, list, put, get, head, delete and
 * multi-delete. A developer with a real RustFS on :9000 reuses it instead (see playwright.config.ts).
 */
interface StoredObject {
    body: Buffer;
    contentType: string;
}

const PORT = Number(process.env.E2E_S3_PORT ?? 9000);
const objects = new Map<string, StoredObject>();

const xml = (body: string, status = 200) =>
    new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
        status,
        headers: { 'Content-Type': 'application/xml' },
    });

const objectHeaders = (object: StoredObject) => ({
    'Content-Type': object.contentType,
    'Content-Length': String(object.body.length),
    ETag: '"etag"',
    'Last-Modified': new Date().toUTCString(),
});

const bucketRequest = async (request: Request, url: URL, bucket: string): Promise<Response> => {
    if (url.searchParams.has('location')) return xml('<LocationConstraint>us-east-1</LocationConstraint>');

    if (request.method === 'POST' && url.searchParams.has('delete')) {
        const text = await request.text();

        for (const match of text.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) {
            objects.delete(match[1].replaceAll('&amp;', '&'));
        }

        return xml('<DeleteResult></DeleteResult>');
    }

    if (request.method === 'GET') {
        const prefix = url.searchParams.get('prefix') ?? '';

        const contents = [...objects.entries()]
            .filter(([name]) => name.startsWith(prefix))
            .map(
                ([name, object]) =>
                    `<Contents><Key>${encodeURIComponent(name)}</Key><LastModified>${new Date().toISOString()}</LastModified><ETag>"etag"</ETag><Size>${object.body.length}</Size></Contents>`
            )
            .join('');

        return xml(
            `<ListBucketResult><Name>${bucket}</Name><Prefix>${prefix}</Prefix><KeyCount>${objects.size}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><EncodingType>url</EncodingType>${contents}</ListBucketResult>`
        );
    }

    return new Response(null, { status: 200 });
};

const objectRequest = async (request: Request, key: string): Promise<Response> => {
    if (request.method === 'PUT') {
        objects.set(key, {
            body: Buffer.from(await request.arrayBuffer()),
            contentType: request.headers.get('content-type') ?? 'application/octet-stream',
        });

        return new Response(null, { status: 200, headers: { ETag: '"etag"' } });
    }

    if (request.method === 'DELETE') {
        objects.delete(key);

        return new Response(null, { status: 204 });
    }

    const object = objects.get(key);

    if (!object) {
        return xml(`<Error><Code>NoSuchKey</Code><Message>missing</Message><Key>${key}</Key></Error>`, 404);
    }

    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: objectHeaders(object) });

    return new Response(new Uint8Array(object.body), { status: 200, headers: objectHeaders(object) });
};

Bun.serve({
    port: PORT,
    async fetch(request) {
        const url = new URL(request.url);
        const [, bucket, ...rest] = url.pathname.split('/');
        const key = decodeURIComponent(rest.join('/'));

        if (!bucket) return xml('<ListAllMyBucketsResult><Buckets></Buckets></ListAllMyBucketsResult>');

        return key ? objectRequest(request, key) : bucketRequest(request, url, bucket);
    },
});
