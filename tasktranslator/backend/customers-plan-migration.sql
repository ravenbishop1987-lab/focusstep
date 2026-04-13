-- Run this in Supabase before deploying the new translator pricing.

alter table if exists customers
  drop constraint if exists customers_plan_check;

alter table if exists customers
  alter column plan set default 'free';

alter table if exists customers
  add constraint customers_plan_check
  check (plan in ('free', 'plus', 'unlimited', 'monthly', 'lifetime'));
