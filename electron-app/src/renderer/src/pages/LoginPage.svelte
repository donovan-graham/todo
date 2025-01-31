<script lang="ts">
    import LoginForm from '../components/LoginForm.svelte';
    import RegisterForm from '../components/RegisterForm.svelte';
    import SimpleForm from '../components/SimpleForm.svelte';
</script>

<div class="layout">
    <LoginForm /> 
    <RegisterForm />
    <!-- <hr />    
    <SimpleForm /> -->
</div>

<style>
 .layout {
    display: flex;
    flex-direction: row;
 }
</style>
