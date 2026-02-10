import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';

function Groups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

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
    };

    if (loading) {
        return (
            <div className="page">
                <h1 className="page-title">Groups</h1>
                <div className="flex flex-col gap-sm">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--r-lg)' }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <h1 className="page-title">Groups</h1>

            <div className="group-actions">
                <button className="btn btn-secondary" onClick={() => setShowJoinModal(true)}>
                    Join Group
                </button>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    + Create
                </button>
            </div>

            {error && <p className="text-error text-sm mb-md">{error}</p>}

            {groups.length === 0 ? (
                <div className="feed-empty">
                    <div className="feed-empty-icon">👥</div>
                    <h2>No groups yet</h2>
                    <p>Create a group or join one with an invite code.</p>
                </div>
            ) : (
                <div className="group-list">
                    {groups.map((group) => (
                        <div key={group.id} className="group-row">
                            <div className="group-icon">🍲</div>
                            <div className="group-info">
                                <div className="group-name">{group.name}</div>
                                <div className="group-detail">
                                    {group.memberCount} members · {group.recipeCount} recipes
                                </div>
                                <div className="invite-row">
                                    <span className="invite-code-text">{group.inviteCode}</span>
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => copyInviteCode(group.inviteCode)}
                                        title="Copy invite code"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>
                            {group.role === 'admin' && (
                                <span className="group-badge">Admin</span>
                            )}
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
                    {formError && <p className="text-error text-sm mb-md">{formError}</p>}
                    <div className="flex gap-sm">
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
                            style={{ flex: 1 }}
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
                    <p className="text-secondary text-sm mb-lg">
                        Enter the invite code shared by your friend.
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
                    {formError && <p className="text-error text-sm mb-md">{formError}</p>}
                    <div className="flex gap-sm">
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
                            style={{ flex: 1 }}
                            disabled={formLoading}
                        >
                            {formLoading ? 'Joining...' : 'Join Group'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

export default Groups;
