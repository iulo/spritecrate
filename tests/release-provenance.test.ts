import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';

// Exercise the Sigstore configuration actually used by Lerna's publisher.
const lerna = createRequire(
  realpathSync(new URL('../node_modules/lerna/package.json', import.meta.url)),
);
const publisher = createRequire(lerna.resolve('libnpmpublish'));
const { createBundleBuilder } = publisher(
  path.join(path.dirname(publisher.resolve('sigstore')), 'config.js'),
);

it.each([
  { status: 409, location: true, recover: true },
  { status: 409, location: false, recover: false },
  { status: 500, location: true, recover: false },
])(
  'handles Rekor status $status with Location=$location',
  async ({ status, location, recover }) => {
    const uuid = 'a'.repeat(80);
    const entry = {
      body: 'recorded-entry',
      logIndex: 1,
      verification: { signedEntryTimestamp: 'proof' },
    };
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      request.resume();
      response.setHeader('Content-Type', 'application/json');
      if (request.method === 'POST') {
        if (location) response.setHeader('Location', `/api/v1/log/entries/${uuid}`);
        response.writeHead(status);
        response.end(
          JSON.stringify({ message: `an equivalent entry already exists with UUID ${uuid}` }),
        );
      } else {
        response.end(JSON.stringify({ [uuid]: entry }));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const builder = createBundleBuilder('dsseEnvelope', {
        rekorURL: `http://127.0.0.1:${port}`,
        retry: 0,
      });
      const result = builder.witnesses[0].tlogV1.createEntry({
        kind: 'dsse',
        apiVersion: '0.0.1',
        spec: {},
      });
      if (recover) {
        await expect(result).resolves.toEqual({ ...entry, uuid });
        expect(requests).toEqual(['POST /api/v1/log/entries', `GET /api/v1/log/entries/${uuid}`]);
      } else {
        await expect(result).rejects.toMatchObject({ code: 'TLOG_CREATE_ENTRY_ERROR' });
        expect(requests).toEqual(['POST /api/v1/log/entries']);
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
