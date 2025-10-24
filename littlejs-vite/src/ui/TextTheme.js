// src/ui/TextTheme.js
'use strict';
import { vec2, Color, hsl } from 'littlejsengine';

export const TextTheme = {
  fontFamily: 'GameFont, Arial, sans-serif',
  fontSize: 36, // pixel height base
  textColor: hsl(0.13, 1, 0.9),
  boxColor: new Color(0, 0, 0, 0.7),
  borderColor: hsl(0.1, 1, 0.3),
  boxSize: vec2(12, 2.5),
  lineSpacing: 0.3,
};