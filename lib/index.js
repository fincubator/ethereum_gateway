import { appConfig, app } from './app';
import { web3 } from './web3';
import './middlewares';
import './views';

app.listen(appConfig.port);
