const express = require("express");
const requestRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const ConnectionRequest = require("../modals/connectionReq");
const User = require("../modals/userSchema");

requestRouter.post("/send/:toUserId", userAuth, async (req, res) => {
  try {
    const toUserId = req.params.toUserId;
    const loggedInUser = req.user;
    const fromUserId = loggedInUser._id;
    if (!toUserId) {
      return res.status(400).send("To User Id is required");
    }

    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).send("To User not found");
    }

    if (toUserId.toString() === fromUserId.toString()) {
      return res
        .status(400)
        .send("You cannot send a connection request to yourself");
    }

    const existingRequest = await ConnectionRequest.findOne({
      $or: [
        {
          fromUserId: fromUserId,
          toUserId: toUserId,
        },
        {
          fromUserId: toUserId,
          toUserId: fromUserId,
        },
      ],
    });

    if (existingRequest) {
      return res
        .status(400)
        .send(
          `Connection request already exists between you and ${toUser.firstName}`
        );
    }

    const newConnectionRequest = new ConnectionRequest({
      fromUserId,
      toUserId,
      status: "pending",
    });

    await newConnectionRequest.save();
    res.status(201).json({
      message: `Connection request sent to ${toUser.firstName}`,
    });
  } catch (error) {
    return res
      .status(500)
      .send("Error sending connection request: " + error.message);
  }
});

requestRouter.patch(
  "/review/:status/:requestId",
  userAuth,
  async (req, res) => {
    try {
      const loggedInUser = req.user;
      const requestId = req.params.requestId;
      const status = req.params.status;
      const toUserId = loggedInUser._id;

      if (!requestId || !status) {
        return res.status(400).send("Request ID and status are required");
      }

      const validStatuses = ["accepted", "rejected", "ignored"];
      if (!validStatuses.includes(status)) {
        return res
          .status(400)
          .send(
            "Invalid status. Valid statuses are: " + validStatuses.join(", ")
          );
      }

      const connectionRequest = await ConnectionRequest.findOne({
        _id: requestId,
        toUserId: toUserId,
        status: "pending",
      });

      if (!connectionRequest) {
        return res
          .status(404)
          .send("Connection request not found or already processed");
      }

      connectionRequest.status = status;
      await connectionRequest.save();

      res.status(200).json({
        message: `Connection request ${status} successfully`,
      });
    } catch (error) {
      return res
        .status(500)
        .send("Error reviewing connection request: " + error.message);
    }
  }
);

module.exports = requestRouter;
