<script lang="ts">
    import { user } from '../stores/user.svelte'
    import { navigate } from "svelte-routing";

    let listId = $state('');
    let isSubmitting = $state(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        isSubmitting = true;
        const url = `http://localhost:3000/api/v1/lists/${listId}`;
        try {
            const response = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user.authToken}`
                },
                mode: "cors",
                credentials: "same-origin",
            });

            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const json = await response.json();
            navigate(`/lists/${listId}`)
        } catch (error) {
            console.error("fetch >>", error.message);
        } finally {
            isSubmitting = false;
        }
    }
</script>

<h1>Join a list</h1>
<form id="join-list-form" onsubmit={handleSubmit}>
    <label for="join-list-name">List code</label>
    <input type="text" id="join-list-name" data-testid="join-list-name" name="join-list-name" required bind:value={listId}>
    <button type="submit" id="join-list-submit" data-testid="join-list-submit" onclick={handleSubmit} disabled={isSubmitting}>Join</button>
</form>