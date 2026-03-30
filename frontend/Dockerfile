FROM node:22-alpine AS builder
WORKDIR /app
# Copy all files for install and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
# Clean install, clear cache, and build
RUN npm install && npm run build && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Copy only production node_modules and build output
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["npm", "start"]
