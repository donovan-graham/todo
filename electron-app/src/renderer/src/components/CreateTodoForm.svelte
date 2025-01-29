<script lang="ts">
    let { handleSubmit } = $props();
    let description = $state('');
</script>
<form id="new-todo-form" onsubmit={handleSubmit}>
    <label for="new-todo-name">Description</label>
    <input type="text" id="new-todo-name" data-testid="new-todo-name" name="new-todo-name" required bind:value={description}>
    <button type="submit" id="new-todo-submit" data-testid="new-todo-submit" onclick={handleSubmit} disabled={isSubmitting}>Create</button>
</form>