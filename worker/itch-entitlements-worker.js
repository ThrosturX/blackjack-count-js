const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://throstur.itch.io',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const json = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
    }
});

const handleOptions = () => new Response(null, { status: 204, headers: corsHeaders });

const fetchRewardEntitlements = async ({ gameId, accessToken }) => {
    const url = new URL('https://itch.io/api/1/oauth/my-owned-keys');
    url.searchParams.set('game_id', gameId);
    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    const keys = Array.isArray(data.owned_keys) ? data.owned_keys : [];
    return keys
        .map((entry) => entry && entry.reward_id)
        .filter((rewardId) => rewardId !== undefined && rewardId !== null)
        .map((rewardId) => String(rewardId));
};

export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return handleOptions();
        }
        if (request.method !== 'GET') {
            return json(405, { error: 'method_not_allowed' });
        }

        const url = new URL(request.url);
        const gameId = url.searchParams.get('game_id');
        if (!gameId) {
            return json(400, { error: 'missing_game_id' });
        }

        const authHeader = request.headers.get('Authorization') || '';
        const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        const accessToken = tokenMatch ? tokenMatch[1] : null;
        if (!accessToken) {
            return json(401, { error: 'missing_access_token' });
        }

        try {
            const rewardIds = await fetchRewardEntitlements({ gameId, accessToken });
            return json(200, { rewardIds });
        } catch (error) {
            return json(500, { error: 'entitlements_failed' });
        }
    }
};
