import { PLANS } from './plans.js';

export const TOPUP_PACKAGES = {
  starter: {
    id: 'starter',
    name: 'Starter Pack',
    price: 500000,
    credits: 500,
    bonus: 0,
    periodDays: 365,
    desc: 'Cukup untuk ±8 artikel lengkap dengan 3 gambar AI.'
  },
  growth: {
    id: 'growth',
    name: 'Growth Pack',
    price: 1000000,
    credits: 1050,
    bonus: 50,
    periodDays: 365,
    desc: 'Bonus +50 credit. Cukup untuk ±14 artikel bergambar & riset topik.'
  },
  scale: {
    id: 'scale',
    name: 'Scale Pack',
    price: 2500000,
    credits: 2750,
    bonus: 250,
    periodDays: 365,
    desc: 'Bonus +250 credit. Skala besar untuk tim agency & brand aktif.'
  }
};

export function getCatalog() {
  return {
    currency: 'IDR',
    topupPackages: Object.values(TOPUP_PACKAGES),
    plans: Object.values(PLANS).filter(p => p.id !== 'free' && p.price > 0)
  };
}

export { PLANS };
