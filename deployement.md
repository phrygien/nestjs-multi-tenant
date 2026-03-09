# Prisma client
npx prisma generate --schema=prisma/master/schema.prisma
npx prisma generate --schema=prisma/tenant/schema.prisma

npx prisma migrate dev --config=prisma/master/prisma.config.ts --name init_master
npx prisma migrate dev --config=prisma/tenant/prisma.config.ts --name init_tenant --create-only



# Config Domain Pour le sous domaine de tenancy example example.localhost:3000
