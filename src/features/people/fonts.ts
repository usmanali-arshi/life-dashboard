import { Caveat, DM_Sans, Fraunces } from 'next/font/google';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap', axes: ['opsz'] });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat', display: 'swap' });

/** Apply to the People root so the CSS font variables resolve. */
export const peopleFontClass = `${fraunces.variable} ${dmSans.variable} ${caveat.variable}`;
