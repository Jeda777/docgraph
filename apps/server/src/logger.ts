import {
  configure,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogger,
  getTextFormatter,
} from '@logtape/logtape'
import { config } from './config'

const formatter =
  config.LOG_FORMAT === 'json'
    ? // Values live in `properties`; a static message lets aggregators group identical events
      getJsonLinesFormatter({ message: 'template' })
    : getTextFormatter({ timestamp: 'date-time', timeZone: null, value: 'bare' })

export const setupLogging = () =>
  configure({
    sinks: { console: getConsoleSink({ formatter }) },
    loggers: [
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
      { category: 'app', lowestLevel: config.LOG_LEVEL, sinks: ['console'] },
    ],
  })

/** Logger for a subsystem, e.g. log('auth') -> category ['app', 'auth'] */
export const log = (...category: string[]) => getLogger(['app', ...category])
