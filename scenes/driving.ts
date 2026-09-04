import { defineScene } from 'dotscene'
import { car } from './car.ts'
import { person } from './person.ts'

/**
 * The car faces left, so the driver is mirrored to face the same way and scaled only enough
 * to sit under the roof. Nothing constrains the hands to a wheel — the seated pose is
 * authored to land there once transformed.
 */
export const scene = defineScene('driving', {
  title: 'A person driving a car',
  parts: [
    { figure: car },
    { figure: person, id: 'driver', pose: 'drive', scale: 1, flipX: true, at: [94, 10] },
  ],
})
