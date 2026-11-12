import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { hasInAppBackHistory, recordInAppNavigation, resetNavigationDepthForTests } from './navigationHistory';

describe('navigationHistory', () => {
    beforeEach(() => {
        resetNavigationDepthForTests();
    });

    it('reports no back history before any navigation is recorded', () => {
        expect(hasInAppBackHistory()).toBe(false);
    });

    it('reports no back history after only the initial page load is recorded', () => {
        recordInAppNavigation();

        expect(hasInAppBackHistory()).toBe(false);
    });

    it('reports back history once a second in-app navigation is recorded', () => {
        recordInAppNavigation(); // initial load
        recordInAppNavigation(); // first SPA navigation

        expect(hasInAppBackHistory()).toBe(true);
    });

    it('keeps reporting back history for further navigations', () => {
        recordInAppNavigation();
        recordInAppNavigation();
        recordInAppNavigation();

        expect(hasInAppBackHistory()).toBe(true);
    });

    it('resets to no back history after resetNavigationDepthForTests', () => {
        recordInAppNavigation();
        recordInAppNavigation();
        expect(hasInAppBackHistory()).toBe(true);

        resetNavigationDepthForTests();

        expect(hasInAppBackHistory()).toBe(false);
    });
});
