import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1A14',
    textSecondary: '#5B6B64',
    textTertiary: '#8E9B95',
    background: '#F2F5F3',
    card: '#FFFFFF',
    cardPressed: '#ECEFED',
    fill: '#E7ECE9',
    separator: '#E1E6E3',
    tint: '#0E8A63',
    tintSoft: '#DDF3EA',
    onTint: '#FFFFFF',
    income: '#0E8A63',
    danger: '#D93A3F',
    dangerSoft: '#FCE4E4',
    warning: '#C27803',
    warningSoft: '#FDF0D5',
    hero: '#0E8A63',
    heroText: '#FFFFFF',
    heroTextSecondary: 'rgba(255,255,255,0.78)',
    overlay: 'rgba(0,0,0,0.35)',
  },
  dark: {
    text: '#F2F7F4',
    textSecondary: '#A3B1AA',
    textTertiary: '#6F7D76',
    background: '#000000',
    card: '#151A18',
    cardPressed: '#1F2623',
    fill: '#232B28',
    separator: '#26302C',
    tint: '#34D399',
    tintSoft: '#0F2D22',
    onTint: '#04150F',
    income: '#34D399',
    danger: '#FF6B6B',
    dangerSoft: '#3A1517',
    warning: '#FBBF24',
    warningSoft: '#33270B',
    hero: '#0B3B2B',
    heroText: '#F2F7F4',
    heroTextSecondary: 'rgba(242,247,244,0.72)',
    overlay: 'rgba(0,0,0,0.55)',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/** Height of the bottom tab bar on platforms where content doesn't inset itself. */
export const TabBarHeight = Platform.select({ web: 76, default: 0 });

export const MaxContentWidth = 640;

/** Hides the browser's focus ring on text fields in the web build; nothing on iOS. */
export const NoFocusRing = Platform.select({ web: { outlineStyle: 'none' }, default: {} }) as object;

export const Fonts = {
  /** Rounded digits for money on iOS. */
  rounded: Platform.select({ ios: 'ui-rounded', default: undefined }),
};
