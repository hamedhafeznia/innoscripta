# ---- build ----------------------------------------------------------------
# No API keys are passed here, by design: the bundle is key-free and the same
# image works for any reviewer who supplies their own keys at run time.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve ----------------------------------------------------------------
FROM nginx:1.27-alpine
# The nginx image runs envsubst over /etc/nginx/templates/*.template at startup,
# so the keys land in the config only in the running container.
COPY nginx/templates/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
