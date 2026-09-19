const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

router.use(auth);

// ======================================================
// LIST MY NOTIFICATIONS
// GET /api/notifications?page=&limit=&unreadOnly=
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;

    const filter = { user: req.user.id };
    if (unreadOnly === "true") filter.read = false;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.max(Number(limit), 1);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * currentLimit)
        .limit(currentLimit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user.id, read: false }),
    ]);

    res.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        total,
        page: currentPage,
        limit: currentLimit,
        pages: Math.ceil(total / currentLimit) || 1,
      },
    });
  } catch (error) {
    console.error("GET notifications error:", error);
    res.status(500).json({ success: false, message: "Error fetching notifications", error: error.message });
  }
});

// ======================================================
// MARK ONE AS READ
// PATCH /api/notifications/:id/read
// ======================================================

router.patch("/:id/read", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID" });
    }

    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error("PATCH notification read error:", error);
    res.status(500).json({ success: false, message: "Error updating notification", error: error.message });
  }
});

// ======================================================
// MARK ALL AS READ
// PATCH /api/notifications/read-all
// ======================================================

router.patch("/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("PATCH notifications read-all error:", error);
    res.status(500).json({ success: false, message: "Error updating notifications", error: error.message });
  }
});

// ======================================================
// DELETE ONE
// DELETE /api/notifications/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID" });
    }

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("DELETE notification error:", error);
    res.status(500).json({ success: false, message: "Error deleting notification", error: error.message });
  }
});

module.exports = router;
