import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Steps from './components/Steps.vue';

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component('Steps', Steps);
    },
} satisfies Theme;
