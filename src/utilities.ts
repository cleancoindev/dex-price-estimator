import { Request } from 'express'
import { Orderbook, Offer } from '@gnosis.pm/dex-contracts'
import { LabelValues, Counter, Histogram } from 'prom-client'

export function isKeyOf<T extends object>(obj: T, possibleKey: keyof any): possibleKey is keyof T {
  return possibleKey in obj
}

export function getHops(request: Request, maxHops: number) {
  if (request.query.hops && parseInt(request.query.hops) < maxHops) {
    return parseInt(request.query.hops)
  } else {
    return maxHops
  }
}

export function sortOrderbookBySerializedPrice(orderbook: Orderbook) {
  const { bids, asks } = orderbook.getOffers()
  bids.sort(sortDescending)
  asks.sort(sortAscending)
  return {
    bids: bids.map(function (bid) {
      return {
        price: bid.price.toNumber(),
        volume: bid.volume.toNumber(),
      }
    }),
    asks: asks.map(function (ask) {
      return {
        price: ask.price.toNumber(),
        volume: ask.volume.toNumber(),
      }
    }),
  }
}

function sortAscending(left: Offer, right: Offer) {
  return left.price.toNumber() - right.price.toNumber()
}

function sortDescending(left: Offer, right: Offer) {
  return sortAscending(left, right) * -1
}

interface ExecuteWithMetricsParams<T extends string> {
  runnable: () => Promise<void>
  totalCount: Counter<T>
  errorsCount: Counter<T>
  durationsTotals: Histogram<T>
  labelValues?: LabelValues<T>
  durations?: Histogram<T>
  count?: Counter<T>
}

export async function executeWithMetrics<T extends string>(params: ExecuteWithMetricsParams<T>) {
  const { runnable, totalCount, count, errorsCount, durationsTotals, durations, labelValues } = params

  // Total count, and count by labels
  totalCount.inc()
  if (count && labelValues) {
    count.inc(labelValues)
  }
  const endTimerTotal = durationsTotals.startTimer()
  const endTimer = durations?.startTimer()
  try {
    // Run
    await runnable()
  } catch (error) {
    // Count errors and rethrow
    errorsCount.inc()
    throw error
  } finally {
    // End timers
    endTimerTotal()
    if (endTimer && labelValues) {
      endTimer(labelValues)
    }
  }
}
