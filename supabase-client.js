(() => {
    const { createClient } = window.supabase || {};

    if (typeof createClient !== 'function') {
        throw new Error('Supabase JS failed to load. Check the Supabase CDN script.');
    }

    window.caterConnectSupabase = createClient(
        'https://tdrvuuifjlwvcxlpfhbd.supabase.co',
        'sb_publishable_jphtpXK-M-fhAFw39TN1xw_C_s2mC94'
    );
})();
