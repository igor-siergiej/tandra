import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormSection } from './FormSection';

describe('FormSection', () => {
    it('renders the title as a heading and renders its children', () => {
        render(
            <FormSection title="Basics">
                <p>Child content</p>
            </FormSection>
        );

        expect(screen.getByRole('heading', { name: 'Basics' })).toBeInTheDocument();
        expect(screen.getByText('Child content')).toBeInTheDocument();
    });
});
