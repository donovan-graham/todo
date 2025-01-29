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
        const url = "http://localhost:3000/api/v1/users";
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

<h2>Register</h2>
<form id="register-form" onsubmit={handleSubmit}>
    <label for="register-username">Username</label>
    <input type="text" id="register-username" data-testid="register-username" name="register-username" required bind:value={username}>
 
    <label for="register-password">Password</label>
    <input type="password" id="register-password" data-testid="register-password" name="register-password" required bind:value={password}>

    <button type="submit" id="register-submit" data-testid="register-submit" onclick={handleSubmit}>Register</button>
</form>