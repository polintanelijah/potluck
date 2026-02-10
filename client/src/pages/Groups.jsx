import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';

function Groups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    // Form states
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [formError, setFormError] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const data = await api.get('/groups');
            setGroups(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!newGroupName.trim()) {
            setFormError('Please enter a group name');
            return;
        }

        setFormLoading(true);
        try {
            await api.post('/groups', {
                name: newGroupName,
                description: newGroupDescription
            });
            setShowCreateModal(false);
            setNewGroupName('');
            setNewGroupDescription('');
            fetchGroups();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleJoinGroup = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!inviteCode.trim()) {
            setFormError('Please enter an invite code');
            return;
        }

        setFormLoading(true);
        try {
            await api.post('/groups/join', { inviteCode });
            setShowJoinModal(false);
            setInviteCode('');
            fetchGroups();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const copyInviteCode = (code) => {
        navigator.clipboard.writeText(code);
        // Could add a toast notification here
    };

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="groups-grid">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="card loading" style={{ height: '180px' }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="flex justify-between items-center mb-xl">
                    <h1>Your Groups</h1>
                    <div className="flex gap-md">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowJoinModal(true)}
                        >
                            Join Group
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowCreateModal(true)}
                        >
                            + Create Group
                        </button>
                    </div>
                </div>

                {error && (
                    <p className="form-error mb-lg">{error}</p>
                )}

                {groups.length === 0 ? (
                    <div className="feed-empty">
                        <div className="feed-empty-icon">👥</div>
                        <h2>No groups yet</h2>
                        <p className="text-secondary mt-sm mb-lg">
                            Create a group to start sharing recipes with friends, or join one with an invite code.
                        </p>
                        <div className="flex gap-md justify-center">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowJoinModal(true)}
                            >
                                Join with Code
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowCreateModal(true)}
                            >
                                Create Your First Group
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="groups-grid">
                        {groups.map((group) => (
                            <div key={group.id} className="card group-card">
                                <div className="group-card-header">
                                    <div className="group-card-icon">🍲</div>
                                    <span className={`badge ${group.role === 'admin' ? 'badge-admin' : ''}`}>
                                        {group.role === 'admin' ? '👑 Admin' : 'Member'}
                                    </span>
                                </div>
                                <h3 className="card-title">{group.name}</h3>
                                {group.description && (
                                    <p className="card-subtitle">{group.description}</p>
                                )}

                                <div className="invite-code mt-md">
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Invite:</span>
                                    <span className="invite-code-value">{group.inviteCode}</span>
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => copyInviteCode(group.inviteCode)}
                                        title="Copy invite code"
                                    >
                                        📋
                                    </button>
                                </div>

                                <div className="group-card-stats">
                                    <div className="group-stat">
                                        <div className="group-stat-value">{group.memberCount}</div>
                                        <div className="group-stat-label">Members</div>
                                    </div>
                                    <div className="group-stat">
                                        <div className="group-stat-value">{group.recipeCount}</div>
                                        <div className="group-stat-label">Recipes</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Group Modal */}
                <Modal
                    isOpen={showCreateModal}
                    onClose={() => {
                        setShowCreateModal(false);
                        setFormError('');
                        setNewGroupName('');
                        setNewGroupDescription('');
                    }}
                    title="Create a Group"
                >
                    <form onSubmit={handleCreateGroup}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="groupName">Group Name</label>
                            <input
                                id="groupName"
                                type="text"
                                className="form-input"
                                placeholder="e.g., Sunday Dinner Club"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                disabled={formLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="groupDescription">Description (optional)</label>
                            <textarea
                                id="groupDescription"
                                className="form-input"
                                placeholder="What's this group about?"
                                value={newGroupDescription}
                                onChange={(e) => setNewGroupDescription(e.target.value)}
                                disabled={formLoading}
                                rows={3}
                            />
                        </div>

                        {formError && (
                            <p className="form-error mb-md">{formError}</p>
                        )}

                        <div className="flex gap-md justify-end">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowCreateModal(false)}
                                disabled={formLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={formLoading}
                            >
                                {formLoading ? 'Creating...' : 'Create Group'}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* Join Group Modal */}
                <Modal
                    isOpen={showJoinModal}
                    onClose={() => {
                        setShowJoinModal(false);
                        setFormError('');
                        setInviteCode('');
                    }}
                    title="Join a Group"
                >
                    <form onSubmit={handleJoinGroup}>
                        <p className="text-secondary mb-lg">
                            Enter the invite code shared by your friend to join their group.
                        </p>

                        <div className="form-group">
                            <label className="form-label" htmlFor="inviteCode">Invite Code</label>
                            <input
                                id="inviteCode"
                                type="text"
                                className="form-input"
                                placeholder="e.g., A1B2C3D4"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                disabled={formLoading}
                                style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}
                            />
                        </div>

                        {formError && (
                            <p className="form-error mb-md">{formError}</p>
                        )}

                        <div className="flex gap-md justify-end">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowJoinModal(false)}
                                disabled={formLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={formLoading}
                            >
                                {formLoading ? 'Joining...' : 'Join Group'}
                            </button>
                        </div>
                    </form>
                </Modal>
            </div>
        </div>
    );
}

export default Groups;
