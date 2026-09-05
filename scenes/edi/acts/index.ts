/**
 * The lifecycle, in order.
 *
 * This list is the only place the running order lives. Reorder it, drop an act, or add one,
 * and the hero follows — which is the point of every act being a separate file with its own
 * clock. Nothing here says *when* an act starts; that is the arrangement, and it belongs to
 * the hero.
 */

import { act as tender } from './a01-tender.ts'
import { act as ack } from './a02-ack.ts'
import { act as accept } from './a03-accept.ts'
import { act as bol } from './a04-bol.ts'
import { act as dispatch } from './a05-dispatch.ts'
import { act as pickup } from './a06-pickup.ts'
import { act as asn } from './a07-asn.ts'
import { act as terminal } from './a08-terminal.ts'
import { act as delivery } from './a09-delivery.ts'
import { act as delivered } from './a10-delivered.ts'
import { act as invoice } from './a11-invoice.ts'
import { act as payment } from './a12-payment.ts'

export const acts = [
  tender,
  ack,
  accept,
  bol,
  dispatch,
  pickup,
  asn,
  terminal,
  delivery,
  delivered,
  invoice,
  payment,
] as const
