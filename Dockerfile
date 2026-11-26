FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are inlined into the pages at build time, so
# they must be present as build args — the runtime environment from
# compose cannot change them later. (API_INTERNAL_URL is different:
# it is read by server code at request time, so the runtime value
# works for it.)
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
RUN npm run build
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.js ./
EXPOSE 3000
CMD ["npm", "start"]
