import { importModules } from '../utils';
import { app } from '../app';

importModules(__dirname, __filename, module => module.default(app));
