<script lang="ts">
    import { user } from '../stores/user.svelte'

    let { lists = $bindable() } = $props();

    let name = $state('');
    let isSubmitting = $state(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        isSubmitting = true;
        const body = JSON.stringify({ name })
        const url = "http://localhost:3000/api/v1/lists";
        try {
            const response = await fetch(url, {
                method: "POST",
                body,
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
            lists.push(json)
        } catch (error) {
            console.error("fetch >>", error.message);
        } finally {
            isSubmitting = false;
        }
    }
</script>
<h1>Create a new list</h1>
<form id="new-list-form" onsubmit={handleSubmit}>
    <label for="new-list-name">Name</label>
    <input type="text" id="new-list-name" data-testid="new-list-name" name="new-list-name" required bind:value={name}>
    <button type="submit" id="new-list-submit" data-testid="new-list-submit" onclick={handleSubmit} disabled={isSubmitting}>Create</button>
</form>