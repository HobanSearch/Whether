FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_TON_NETWORK
ARG VITE_TONCONNECT_MANIFEST_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_TON_NETWORK=$VITE_TON_NETWORK
ENV VITE_TONCONNECT_MANIFEST_URL=$VITE_TONCONNECT_MANIFEST_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Fix permissions for static assets (nginx runs as non-root)
RUN chmod -R 755 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \;
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
