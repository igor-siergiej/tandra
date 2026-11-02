import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import LoginPage from './index';

let isAuthenticated = false;

vi.mock('../../auth', () => ({ useAuth: () => ({ isAuthenticated }) }));

vi.mock('../../components/LoginForm', () => ({ LoginForm: () => <p>login form</p> }));

const renderAtLogin = () =>
    render(
        <MemoryRouter initialEntries={['/login']}>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<p>home</p>} />
            </Routes>
        </MemoryRouter>
    );

describe('LoginPage', () => {
    it('shows the login form when signed out', () => {
        isAuthenticated = false;
        renderAtLogin();
        expect(screen.getByText('login form')).toBeInTheDocument();
    });

    it('sends a signed-in user to the app', () => {
        isAuthenticated = true;
        renderAtLogin();
        expect(screen.getByText('home')).toBeInTheDocument();
    });
});
