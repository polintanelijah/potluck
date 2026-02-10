const API_BASE = '/api';

class ApiService {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('potluck_token');

        const headers = {
            ...options.headers,
        };

        // Don't set Content-Type for FormData (browser will set it with boundary)
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Something went wrong');
        }

        return data;
    }

    get(endpoint) {
        return this.request(endpoint);
    }

    post(endpoint, body) {
        if (body instanceof FormData) {
            return this.request(endpoint, {
                method: 'POST',
                body,
            });
        }
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    put(endpoint, body) {
        if (body instanceof FormData) {
            return this.request(endpoint, {
                method: 'PUT',
                body,
            });
        }
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }
}

export const api = new ApiService();
