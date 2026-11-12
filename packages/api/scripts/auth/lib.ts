import type { Auth } from '../../src/infrastructure/BetterAuth';

/** Sets a new password for a password user and signs them out of every device. */
export const resetPassword = async (auth: Auth, username: string, newPassword: string): Promise<void> => {
    const ctx = await auth.$context;
    const { minPasswordLength, maxPasswordLength } = ctx.password.config;

    if (newPassword.length < minPasswordLength || newPassword.length > maxPasswordLength) {
        throw new Error(`Password must be at least ${minPasswordLength} and at most ${maxPasswordLength} characters`);
    }

    const user = await ctx.adapter.findOne<{ id: string }>({
        model: 'user',
        where: [{ field: 'username', value: username.toLowerCase() }],
    });

    if (!user) throw new Error(`No user with username ${username}`);

    if (!(await ctx.internalAdapter.findCredentialAccount(user.id))) {
        throw new Error(`${username} signs in with Google only and has no password to reset`);
    }

    await ctx.internalAdapter.updatePassword(user.id, await ctx.password.hash(newPassword));
    await ctx.internalAdapter.deleteUserSessions(user.id);
};
