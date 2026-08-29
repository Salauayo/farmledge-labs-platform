import express from 'express'
import { router } from './routes/index.js'
import { errorHandler } from './middleware/error.middleware.js'
import { requestLogger } from './middleware/logger.middleware.js'
import { auditMiddleware } from './middleware/audit.middleware.js'

const app = express()

app.use(requestLogger)
app.use(express.json())
app.use(auditMiddleware)
app.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok', version: '0.1.0', service: 'farmledge-api' })
})
app.use(router)

app.use(errorHandler)

export default app
