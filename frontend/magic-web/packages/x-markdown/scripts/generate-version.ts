import fs from 'fs';
import path from 'path';

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'version', 'version.ts'),
  `export default '${version}';`,
  'utf8',
);

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'plugins', 'version', 'version.ts'),
  `export default '${version}';`,
  'utf8',
);
