import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Generate a short invite code
const generateInviteCode = () => {
    return uuidv4().split('-')[0].toUpperCase();
};

// Get user's groups
router.get('/', authMiddleware, (req, res) => {
    try {
        const groups = db.prepare(`
      SELECT g.*, m.role, m.joined_at,
        (SELECT COUNT(*) FROM memberships WHERE group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM recipes WHERE group_id = g.id) as recipe_count
      FROM groups g
      JOIN memberships m ON m.group_id = g.id
      WHERE m.user_id = ?
      ORDER BY m.joined_at DESC
    `).all(req.userId);

        res.json(groups.map(g => ({
            id: g.id,
            name: g.name,
            description: g.description,
            inviteCode: g.invite_code,
            role: g.role,
            memberCount: g.member_count,
            recipeCount: g.recipe_count,
            joinedAt: g.joined_at,
            createdAt: g.created_at
        })));
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single group with members
router.get('/:id', authMiddleware, (req, res) => {
    try {
        const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check membership
        const membership = db.prepare(
            'SELECT * FROM memberships WHERE user_id = ? AND group_id = ?'
        ).get(req.userId, req.params.id);

        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Get members
        const members = db.prepare(`
      SELECT u.id, u.display_name, u.avatar_url, m.role, m.joined_at
      FROM users u
      JOIN memberships m ON m.user_id = u.id
      WHERE m.group_id = ?
      ORDER BY m.joined_at ASC
    `).all(req.params.id);

        res.json({
            id: group.id,
            name: group.name,
            description: group.description,
            inviteCode: group.invite_code,
            createdAt: group.created_at,
            role: membership.role,
            members: members.map(m => ({
                id: m.id,
                displayName: m.display_name,
                avatarUrl: m.avatar_url,
                role: m.role,
                joinedAt: m.joined_at
            }))
        });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create group
router.post('/', authMiddleware, (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        const inviteCode = generateInviteCode();

        const result = db.prepare(
            'INSERT INTO groups (name, description, invite_code, created_by) VALUES (?, ?, ?, ?)'
        ).run(name, description || null, inviteCode, req.userId);

        // Add creator as admin member
        db.prepare(
            'INSERT INTO memberships (user_id, group_id, role) VALUES (?, ?, ?)'
        ).run(req.userId, result.lastInsertRowid, 'admin');

        res.status(201).json({
            message: 'Group created successfully',
            group: {
                id: result.lastInsertRowid,
                name,
                description,
                inviteCode
            }
        });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Join group with invite code
router.post('/join', authMiddleware, (req, res) => {
    try {
        const { inviteCode } = req.body;

        if (!inviteCode) {
            return res.status(400).json({ error: 'Invite code is required' });
        }

        const group = db.prepare(
            'SELECT * FROM groups WHERE invite_code = ?'
        ).get(inviteCode.toUpperCase());

        if (!group) {
            return res.status(404).json({ error: 'Invalid invite code' });
        }

        // Check if already a member
        const existingMembership = db.prepare(
            'SELECT id FROM memberships WHERE user_id = ? AND group_id = ?'
        ).get(req.userId, group.id);

        if (existingMembership) {
            return res.status(400).json({ error: 'You are already a member of this group' });
        }

        db.prepare(
            'INSERT INTO memberships (user_id, group_id, role) VALUES (?, ?, ?)'
        ).run(req.userId, group.id, 'member');

        res.json({
            message: 'Successfully joined group',
            group: {
                id: group.id,
                name: group.name,
                description: group.description
            }
        });
    } catch (error) {
        console.error('Join group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Leave group
router.post('/:id/leave', authMiddleware, (req, res) => {
    try {
        const groupId = req.params.id;

        const membership = db.prepare(
            'SELECT * FROM memberships WHERE user_id = ? AND group_id = ?'
        ).get(req.userId, groupId);

        if (!membership) {
            return res.status(404).json({ error: 'You are not a member of this group' });
        }

        // Check if user is the only admin
        if (membership.role === 'admin') {
            const adminCount = db.prepare(
                'SELECT COUNT(*) as count FROM memberships WHERE group_id = ? AND role = ?'
            ).get(groupId, 'admin');

            if (adminCount.count === 1) {
                return res.status(400).json({
                    error: 'Cannot leave group as the only admin. Transfer admin role first or delete the group.'
                });
            }
        }

        db.prepare(
            'DELETE FROM memberships WHERE user_id = ? AND group_id = ?'
        ).run(req.userId, groupId);

        res.json({ message: 'Successfully left the group' });
    } catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update group
router.put('/:id', authMiddleware, (req, res) => {
    try {
        const { name, description } = req.body;
        const groupId = req.params.id;

        // Check if user is admin
        const membership = db.prepare(
            'SELECT role FROM memberships WHERE user_id = ? AND group_id = ?'
        ).get(req.userId, groupId);

        if (!membership || membership.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can update group settings' });
        }

        db.prepare(
            'UPDATE groups SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?'
        ).run(name, description, groupId);

        res.json({ message: 'Group updated successfully' });
    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Regenerate invite code
router.post('/:id/regenerate-invite', authMiddleware, (req, res) => {
    try {
        const groupId = req.params.id;

        // Check if user is admin
        const membership = db.prepare(
            'SELECT role FROM memberships WHERE user_id = ? AND group_id = ?'
        ).get(req.userId, groupId);

        if (!membership || membership.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can regenerate invite codes' });
        }

        const newCode = generateInviteCode();
        db.prepare('UPDATE groups SET invite_code = ? WHERE id = ?').run(newCode, groupId);

        res.json({ inviteCode: newCode });
    } catch (error) {
        console.error('Regenerate invite error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
