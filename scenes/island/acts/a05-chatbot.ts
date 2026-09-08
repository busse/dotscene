/**
 * The chatbot that only knows one answer.
 *
 * A screen on a pole with a face, saying "?" to everything, every few seconds. The keeper
 * plugs it into the mainframe — the one that finally rolls — and it starts saying different
 * things: a check, a box, a coin, a page, a place.
 */

import { type Beat, type Part } from 'dotscene'
import { badgeBox, badgeCheck, badgeCoin, badgeDoc, badgePin } from '../../edi/figures/tokens.ts'
import { bubble } from '../figures/misfits.ts'
import { query } from '../figures/fixtures.ts'
import { defineAct, holdAt, stateBefore } from './act.ts'
import { SKY, slackWire, speak, standAt, stringWire, walk, walkTime, wire } from './kit.ts'
import { CHATBOT, HUT, MAINFRAME, WORK } from '../world.ts'
import { FIXED, NIGHT, START } from '../timing.ts'

const B = 'chatbot'
const K = 'keeper'
const BUBBLES = ['bubble0', 'bubble1']
const GLYPHS = [
  ['glyphQuery', query],
  ['glyphCheck', badgeCheck],
  ['glyphBox', badgeBox],
  ['glyphCoin', badgeCoin],
  ['glyphDoc', badgeDoc],
  ['glyphPin', badgePin],
] as const

const parts: Part[] = [
  ...BUBBLES.map((id) => ({ id, figure: bubble, at: CHATBOT.mouth, opacity: 0, depth: SKY + 20 })),
  ...GLYPHS.map(([id, figure]) => ({ id, figure, at: CHATBOT.mouth, opacity: 0, depth: SKY + 21, scale: id === 'glyphQuery' ? 1.2 : 1.1 })),
  { id: 'botWire', figure: wire, at: CHATBOT.port, pose: 'slack', opacity: 0, depth: SKY - 1 },
]

const beats: Beat[] = []

/** A line: the mouth opens, the bubble pops up with what it has to say. */
const say = (glyph: string, at: number, mouthPose = 'talk') => {
  beats.push({ at: at - 100, parts: { [B]: { pose: mouthPose } } })
  beats.push({ at: at + 500, parts: { [B]: { pose: mouthPose === 'happy' ? 'happy' : 'rest' } } })
  beats.push(...speak(BUBBLES[(at / 1000) % 2 < 1 ? 0 : 1]!, glyph, CHATBOT.mouth, at))
}

// One answer, over and over, from dawn until it is fixed.
for (let t = 900; t < FIXED.chatbot - 2600; t += 2700) say('glyphQuery', t)

// The keeper arrives, and runs a cable to the mainframe's socket where it now stands.
beats.push({ at: START.chatbot + 1600, parts: standAt(K, WORK.chatbot, 'idle') })
beats.push({ at: START.chatbot + 2200, parts: standAt(K, WORK.chatbot, 'offerR') })
beats.push(...stringWire('botWire', CHATBOT.port, MAINFRAME.portRolled, START.chatbot + 2400, FIXED.chatbot - 700 - (START.chatbot + 2400)))
beats.push({ at: FIXED.chatbot - 300, parts: standAt(K, WORK.chatbot, 'idle') })
beats.push({ at: FIXED.chatbot, parts: { [B]: { pose: 'happy' } }, easing: 'easeOut' })

// Now it has things to say, until the island goes to sleep.
const answers = ['glyphCheck', 'glyphBox', 'glyphCoin', 'glyphDoc', 'glyphPin']
let n = 0
for (let t = FIXED.chatbot + 700; t < NIGHT.deep - 1000; t += 2300, n++) say(answers[n % answers.length]!, t, 'happy')

// The keeper is pleased, and sets off for the lighthouse as the light goes.
beats.push({ at: FIXED.chatbot + 400, parts: standAt(K, WORK.chatbot, 'wave') })
beats.push({ at: FIXED.chatbot + 1300, parts: standAt(K, WORK.chatbot, 'idle') })
beats.push(...walk(K, WORK.chatbot, HUT.lighthouseDoor, START.dusk, Math.max(walkTime(WORK.chatbot, HUT.lighthouseDoor), 3000)))

// Slack again under cover of night.
beats.push({ at: holdAt(START.reset), parts: { botWire: stateBefore(beats, 'botWire', holdAt(START.reset)), [B]: stateBefore(beats, B, holdAt(START.reset)) } })
beats.push(...slackWire('botWire', CHATBOT.port, START.reset + 50))
beats.push({ at: START.reset + 60, parts: { [B]: { pose: 'rest' } } })

export const act = defineAct('islandChatbot', 'The chatbot with one answer', beats, parts)
