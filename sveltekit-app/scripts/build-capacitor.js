import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const serverLayout = path.join(root, 'src/routes/+layout.server.ts');
const hiddenServerLayout = path.join(root, 'src/routes/+layout.server.ts.capacitor-disabled');

async function run() {
	let movedServerLayout = false;

	try {
		if (existsSync(hiddenServerLayout)) {
			throw new Error(`${hiddenServerLayout} already exists; refusing to overwrite a previous build artifact.`);
		}

		if (existsSync(serverLayout)) {
			await rename(serverLayout, hiddenServerLayout);
			movedServerLayout = true;
		}

		await runViteBuild();
	} finally {
		if (movedServerLayout && existsSync(hiddenServerLayout)) {
			await rename(hiddenServerLayout, serverLayout);
		}
	}
}

function runViteBuild() {
	return new Promise((resolve, reject) => {
		const child = spawn('vite', ['build'], {
			stdio: 'inherit',
			shell: process.platform === 'win32',
			env: {
				...process.env,
				KIOKUN_CAPACITOR: '1',
				VITE_KIOKUN_CAPACITOR: '1'
			}
		});

		child.on('error', reject);
		child.on('exit', (code, signal) => {
			if (signal) {
				reject(new Error(`vite build terminated by ${signal}`));
				return;
			}

			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`vite build exited with code ${code}`));
		});
	});
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
