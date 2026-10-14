import { common } from './common.js';
import { publicTranslations } from './public.js';
import { auth } from './auth.js';
import { app } from './app.js';
import { seo } from './seo.js';
import { ads } from './ads.js';
import { spy } from './spy.js';
import { billing } from './billing.js';
import { settings } from './settings.js';
import { errors } from './errors.js';

export const id = {
  common,
  ...publicTranslations,
  auth,
  ...app,
  seo,
  ads,
  spy,
  billing,
  settings,
  errors,
  public: publicTranslations,
  app
};
