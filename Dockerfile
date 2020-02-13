# node:13.8.0-buster
FROM 1ba8e570807b38d1b2f76906f0c6b05e8a2217255fab52bfe2ee26fae0a22f64 AS base

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm i

FROM base AS builder

COPY src src
COPY .babelrc ./

RUN npm run build

FROM base AS runner

COPY --from=builder /app/dist dist
COPY .sequelizerc ./

CMD npm run serve

ARG PORT

EXPOSE ${PORT}/tcp
