import compression from 'compression';
import errorhandler from 'errorhandler';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { applicationConfigs } from './config/config.app';

const env = process.env.NODE_ENV ?? 'development';
export const appConfig = applicationConfigs[env];
export const app = express();

if (process.env.NODE_ENV === 'development') {
  app.use(errorhandler());
}

app
  .use(morgan('combined'))
  .use(
    helmet({
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: { setTo: 'PHP/5.6.40' },
      ieNoOpen: true,
      noSniff: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'no-referrer' },
      xssFilter: { setOnOldIE: true },
    })
  )
  .use(compression())
  .use(express.urlencoded({ extended: true }))
  .use(express.json());

export const onStart: Promise<void>[] = [];
export const onSignal: Promise<void>[] = [];
