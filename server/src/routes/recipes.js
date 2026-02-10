import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Get feed - recipes from all groups user is member of
router.get('/', authMiddleware, (req, res) => {
    try {
        const recipes = db.prepare(`
      SELECT 
        r.*,
        u.display_name as author_name,
        u.avatar_url as author_avatar,
        g.name as group_name
      FROM recipes r
      JOIN users u ON r.user_id = u.id
      JOIN groups g ON r.group_id = g.id
      JOIN memberships m ON m.group_id = r.group_id
      WHERE m.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT 50
    `).all(req.userId);

        res.json(recipes.map(r => ({
            id: r.id,
            title: r.title,
            sourceUrl: r.source_url,
            sourceName: r.source_name,
            imageUrl: r.image_url,
            rating: r.rating,
            notes: r.notes,
            cookDate: r.cook_date,
            createdAt: r.created_at,
            author: {
                id: r.user_id,
                name: r.author_name,
                avatarUrl: r.author_avatar
            },
            group: {
                id: r.group_id,
                name: r.group_name
            }
        })));
    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single recipe
router.get('/:id', authMiddleware, (req, res) => {
    try {
        const recipe = db.prepare(`
      SELECT 
        r.*,
        u.display_name as author_name,
        u.avatar_url as author_avatar,
        g.name as group_name
      FROM recipes r
      JOIN users u ON r.user_id = u.id
      JOIN groups g ON r.group_id = g.id
      WHERE r.id = ?
    `).get(req.params.id);

        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        // Check if user is member of the group
        const membership = db.prepare(
            'SELECT id FROM memberships WHERE user_id = ? AND group_id = ?'
        ).get(req.userId, recipe.group_id);

        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Get comments
        const comments = db.prepare(`
      SELECT c.*, u.display_name as author_name, u.avatar_url as author_avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.recipe_id = ?
      ORDER BY c.created_at ASC
    `).all(req.params.id);

        res.json({
            id: recipe.id,
            title: recipe.title,
            sourceUrl: recipe.source_url,
            sourceName: recipe.source_name,
            imageUrl: recipe.image_url,
            rating: recipe.rating,
            notes: recipe.notes,
            cookDate: recipe.cook_date,
            createdAt: recipe.created_at,
            author: {
                id: recipe.user_id,
                name: recipe.author_name,
                avatarUrl: recipe.author_avatar
            },
            group: {
                id: recipe.group_id,
                name: recipe.group_name
            },
            comments: comments.map(c => ({
                id: c.id,
                content: c.content,
                createdAt: c.created_at,
                author: {
                    id: c.user_id,
                    name: c.author_name,
                    avatarUrl: c.author_avatar
                }
            }))
        });
    } catch (error) {
        console.error('Get recipe error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create recipe
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
    try {
        const { title, sourceUrl, sourceName, rating, notes, cookDate, groupId } = req.body;

        if (!title || !groupId) {
            return res.status(400).json({ error: 'Title and group are required' });
        }

        // Check if user is member of the group
        const membership = db.prepare(
            'SELECT id FROM memberships WHERE user_id = ? AND group_id = ?'
        ).get(req.userId, groupId);

        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const result = db.prepare(`
      INSERT INTO recipes (user_id, group_id, title, source_url, source_name, image_url, rating, notes, cook_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            req.userId,
            groupId,
            title,
            sourceUrl || null,
            sourceName || null,
            imageUrl,
            rating ? parseInt(rating) : null,
            notes || null,
            cookDate || null
        );

        res.status(201).json({
            message: 'Recipe created successfully',
            recipeId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Create recipe error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update recipe
router.put('/:id', authMiddleware, upload.single('image'), (req, res) => {
    try {
        const { title, sourceUrl, sourceName, rating, notes, cookDate } = req.body;
        const recipeId = req.params.id;

        // Check if user owns the recipe
        const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        if (recipe.user_id !== req.userId) {
            return res.status(403).json({ error: 'You can only edit your own recipes' });
        }

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : recipe.image_url;

        db.prepare(`
      UPDATE recipes 
      SET title = ?, source_url = ?, source_name = ?, image_url = ?, rating = ?, notes = ?, cook_date = ?
      WHERE id = ?
    `).run(
            title || recipe.title,
            sourceUrl !== undefined ? sourceUrl : recipe.source_url,
            sourceName !== undefined ? sourceName : recipe.source_name,
            imageUrl,
            rating ? parseInt(rating) : recipe.rating,
            notes !== undefined ? notes : recipe.notes,
            cookDate !== undefined ? cookDate : recipe.cook_date,
            recipeId
        );

        res.json({ message: 'Recipe updated successfully' });
    } catch (error) {
        console.error('Update recipe error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete recipe
router.delete('/:id', authMiddleware, (req, res) => {
    try {
        const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);

        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        if (recipe.user_id !== req.userId) {
            return res.status(403).json({ error: 'You can only delete your own recipes' });
        }

        db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        console.error('Delete recipe error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add comment to recipe
router.post('/:id/comments', authMiddleware, (req, res) => {
    try {
        const { content } = req.body;
        const recipeId = req.params.id;

        if (!content) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        // Check if recipe exists and user has access
        const recipe = db.prepare('SELECT group_id FROM recipes WHERE id = ?').get(recipeId);
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const membership = db.prepare(
            'SELECT id FROM memberships WHERE user_id = ? AND group_id = ?'
        ).get(req.userId, recipe.group_id);

        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        const result = db.prepare(
            'INSERT INTO comments (recipe_id, user_id, content) VALUES (?, ?, ?)'
        ).run(recipeId, req.userId, content);

        res.status(201).json({
            message: 'Comment added successfully',
            commentId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
