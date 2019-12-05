import * as fs from 'fs';
import * as path from 'path';

const importModule = async (file, callback) => {
  const module = await import(file);

  callback(module);
};

const importModules = (sourcesPath, excludeSourcePath, callback) => {
  fs
    .readdirSync(sourcesPath)
    .filter(file => {
      return (file.indexOf('.') !== 0 &&
              file.slice(-3) === '.js' &&
              file !== path.basename(excludeSourcePath));
    }).forEach(file => importModule(path.join(sourcesPath, file), callback));
}

export { importModules };
