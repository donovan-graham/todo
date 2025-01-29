<script lang="ts">
    import { user } from '../stores/user.svelte'
    import { navigate } from "svelte-routing";

    let username = $state('');
    let password = $state('');
    let isSubmitting = $state(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        isSubmitting = true;
        const body = JSON.stringify({ username, password })
        const url = "http://localhost:3000/api/v1/login";
        try {
            const response = await fetch(url, {
                method: "POST",
                body,
                headers: {
                    "Content-Type": "application/json",
                },
                mode: "cors",
                credentials: "same-origin",
            });

            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const json = await response.json();

            user.authToken = json.token;
            navigate("/lists", { replace: true });

        } catch (error) {
            console.error("fetch >>", error.message);
        } finally {
            isSubmitting = false;
        }
    }
</script>

<h2>Login</h2>
{#if user.isAuthenticated}
    <p>Logged in {user.username}</p>
{/if}

<form id="login-form" onsubmit={handleSubmit}>
    <label for="login-username">Username</label>
    <input type="text" id="login-username" data-testid="login-username" name="login-username" required bind:value={username}>
 
    <label for="login-password">Password</label>
    <input type="password" id="login-password" data-testid="login-password" name="login-password" required bind:value={password}>

    <button type="submit" id="login-submit" data-testid="login-submit" onclick={handleSubmit} disabled={isSubmitting}>Login</button>
</form>