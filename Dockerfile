FROM node:14.11.0-buster AS base

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
