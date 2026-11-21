import { loadFont as loadGeist } from '@remotion/google-fonts/Geist';
import { loadFont as loadGeistMono } from '@remotion/google-fonts/GeistMono';
import { loadFont as loadNewsreader } from '@remotion/google-fonts/Newsreader';

/** The app's palette (src/theme/tamagui.config.ts), so the video looks like Setnote. */
export const color = {
  paper: '#FFFFFF',
  paper2: '#F8F7F4',
  paper3: '#F1EFEA',
  line: '#DFDBD3',
  muted: '#847E75',
  inkSoft: '#4B4741',
  ink: '#1B1A17',
  accent: '#E5532A',
  accentSoft: '#FFF3EE',
  accentInk: '#A83A17',
  camera: '#141311',
};

export const font = {
  display: loadNewsreader('normal', { weights: ['400', '500'], subsets: ['latin'] }).fontFamily,
  body: loadGeist('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily,
  mono: loadGeistMono('normal', { weights: ['400', '500'], subsets: ['latin'] }).fontFamily,
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
/** Cross-fade between scenes. */
export const TRANSITION_FRAMES = 9;
