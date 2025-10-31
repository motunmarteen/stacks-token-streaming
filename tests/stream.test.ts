
import { Cl, cvToValue, signMessageHashRsv, } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const sender = accounts.get("wallet_1")!;
const recipient = accounts.get("wallet_2")!;
const randomUser = accounts.get("wallet_3")!;

describe("Token Streaming Contract Tests", () => {
  beforeEach(() => {
    const result = simnet.callPublicFn(
      "stream",
      "stream-to",
      [
        Cl.principal(recipient),
        Cl.uint(5),
        Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(5)
        }),
        Cl.uint(1),
      ],
      sender
    );
    expect(result.events[0].event).toBe("stx_transfer_event");
    expect(result.events[0].data.amount).toBe("5");
    expect(result.events[0].data.sender).toBe(sender);
  });

  it("should create a stream successfully", () => {
    const latestStreamId = simnet.getDataVar("stream", "latest-stream-id");
    expect(latestStreamId).toBeUint(1);
    
    const createdStream = simnet.getMapEntry("stream", "streams", Cl.uint(0));
    expect(createdStream).toBeSome(
      Cl.tuple({
        sender: Cl.principal(sender),
        recipient: Cl.principal(recipient),
        balance: Cl.uint(5),
        "withdrawn-balance": Cl.uint(0),
        "payment-per-block": Cl.uint(1),
        timeframe: Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(5),
        }),
        status: Cl.ok(Cl.uint(0)),
        "pause-block": Cl.uint(0),
        "total-paused-blocks": Cl.uint(0),
      })
    );
  });

  it("should allow sender to refuel stream", () => {
    const result = simnet.callPublicFn(
      "stream",
      "refuel",
      [Cl.uint(0), Cl.uint(5)],
      sender
    );
    expect(result.events[0].event).toBe("stx_transfer_event");
    expect(result.events[0].data.amount).toBe("5");
    expect(result.events[0].data.sender).toBe(sender);
    
    const createdStream = simnet.getMapEntry("stream", "streams", Cl.uint(0));
    expect(createdStream).toBeSome(
      Cl.tuple({
        sender: Cl.principal(sender),
        recipient: Cl.principal(recipient),
        balance: Cl.uint(10),
        "withdrawn-balance": Cl.uint(0),
        "payment-per-block": Cl.uint(1),
        timeframe: Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(5),
        }),
        status: Cl.ok(Cl.uint(0)),
        "pause-block": Cl.uint(0),
        "total-paused-blocks": Cl.uint(0),
      })
    );
  });

  it("should reject refuel from unauthorized address", () => {
    const result = simnet.callPublicFn(
      "stream",
      "refuel",
      [Cl.uint(0), Cl.uint(5)],
      randomUser
    );
    expect(result.result).toBeErr(Cl.uint(0));
  });

  it("should allow recipient to withdraw accumulated tokens", () => {
    const withdraw = simnet.callPublicFn(
      "stream",
      "withdraw",
      [Cl.uint(0)],
      recipient
    );
    expect(withdraw.events[0].event).toBe("stx_transfer_event");
    expect(withdraw.events[0].data.amount).toBe("4");
    expect(withdraw.events[0].data.recipient).toBe(recipient);
  });

  it("should reject withdrawal from unauthorized address", () => {
    const withdraw = simnet.callPublicFn(
      "stream",
      "withdraw",
      [Cl.uint(0)],
      randomUser
    );
    expect(withdraw.result).toBeErr(Cl.uint(0));
  });

  it("should allow sender to refund excess tokens after stream ends", () => {
    simnet.callPublicFn("stream", "refuel", [Cl.uint(0), Cl.uint(5)], sender);
    simnet.mineEmptyBlock();
    simnet.mineEmptyBlock();
    simnet.callPublicFn("stream", "withdraw", [Cl.uint(0)], recipient);
    const refund = simnet.callPublicFn(
      "stream",
      "refund",
      [Cl.uint(0)],
      sender
    );
    expect(refund.events[0].event).toBe("stx_transfer_event");
    expect(refund.events[0].data.amount).toBe("5");
    expect(refund.events[0].data.recipient).toBe(sender);
  });

  it("should generate valid hash for stream data", () => {
    const hashedStream0 = simnet.callReadOnlyFn(
      "stream",
      "hash-stream",
      [
        Cl.uint(0),
        Cl.uint(0),
        Cl.tuple({
          "start-block": Cl.uint(1),
          "stop-block": Cl.uint(2)
        }),
      ],
      sender
    );
    
    const hashValue = cvToValue(hashedStream0.result);
    expect(hashValue).toBeDefined();
    expect(typeof hashValue).toBe("string");
    expect(hashValue.replace("0x", "").length).toBe(64);
  });

  it("should verify signatures correctly", () => {
    const hashedStream0 = simnet.callReadOnlyFn(
      "stream",
      "hash-stream",
      [
        Cl.uint(0),
        Cl.uint(2),
        Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(6)
        }),
      ],
      sender
    );
    
    const hashValue = cvToValue(hashedStream0.result);
    const privateKey = "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801";
    const hashForSigning = hashValue.replace("0x", "");
    const signature = signMessageHashRsv({
      messageHash: hashForSigning,
      privateKey: privateKey,
    });
    
    const verifySignature = simnet.callReadOnlyFn(
      "stream",
      "validate-signature",
      [
        hashedStream0.result,
        Cl.bufferFromHex(signature),
        Cl.principal(sender),
      ],
      sender
    );
    
    const isValid = cvToValue(verifySignature.result);
    expect(isValid).toBe(true);
  });

  it("should reject invalid signatures for updates", () => {
    const result = simnet.callPublicFn(
      "stream",
      "update-details",
      [
        Cl.uint(0),
        Cl.uint(1),
        Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(4)
        }),
        Cl.principal(sender),
        Cl.bufferFromHex("00".repeat(65)),
      ],
      recipient
    );
    
    expect(result.result).toBeErr(Cl.uint(1));
  });

  it("should update stream details with valid signature", () => {
    const hashedStream0 = simnet.callReadOnlyFn(
      "stream",
      "hash-stream",
      [
        Cl.uint(0),
        Cl.uint(2),
        Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(6)
        }),
      ],
      sender
    );
    
    const hashValue = cvToValue(hashedStream0.result);
    const hashForSigning = hashValue.replace("0x", "");
    const privateKey = "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801";
    const signature = signMessageHashRsv({
      messageHash: hashForSigning,
      privateKey: privateKey,
    });
    
    const updateResult = simnet.callPublicFn(
      "stream",
      "update-details",
      [
        Cl.uint(0),
        Cl.uint(2),
        Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(6)
        }),
        Cl.principal(sender),
        Cl.bufferFromHex(signature),
      ],
      recipient
    );
    
    expect(updateResult.result).toBeOk(Cl.bool(true));
    
    const updatedStream = simnet.getMapEntry("stream", "streams", Cl.uint(0));
    expect(updatedStream).toBeSome(
      Cl.tuple({
        sender: Cl.principal(sender),
        recipient: Cl.principal(recipient),
        balance: Cl.uint(5),
        "withdrawn-balance": Cl.uint(0),
        "payment-per-block": Cl.uint(2),
        timeframe: Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(6),
        }),
        status: Cl.ok(Cl.uint(0)),
        "pause-block": Cl.uint(0),
        "total-paused-blocks": Cl.uint(0),
      })
    );
  });

  describe("Pause and Resume Functionality", () => {
    it("should pause an active stream", () => {
      const pauseResult = simnet.callPublicFn(
        "stream",
        "pause-stream",
        [Cl.uint(0)],
        sender
      );
      
      expect(pauseResult.result).toBeOk(Cl.bool(true));
      
      const streamStatus = simnet.callReadOnlyFn(
        "stream",
        "get-stream-status",
        [Cl.uint(0)],
        sender
      );
      
      const statusResult = cvToValue(streamStatus.result);
      // get-stream-status returns (ok (response uint uint)), so we need to unwrap twice
      const status = statusResult.value?.value !== undefined ? statusResult.value.value : (statusResult.value !== undefined ? statusResult.value : statusResult);
      expect(Number(status)).toBe(1); // STATUS_PAUSED = 1
    });

    it("should prevent pause from non-sender", () => {
      const pauseResult = simnet.callPublicFn(
        "stream",
        "pause-stream",
        [Cl.uint(0)],
        randomUser
      );
      
      expect(pauseResult.result).toBeErr(Cl.uint(0)); // ERR_UNAUTHORIZED
    });

    it("should resume a paused stream", () => {
      simnet.callPublicFn("stream", "pause-stream", [Cl.uint(0)], sender);
      
      simnet.mineEmptyBlock();
      simnet.mineEmptyBlock();
      
      const resumeResult = simnet.callPublicFn(
        "stream",
        "resume-stream",
        [Cl.uint(0)],
        sender
      );
      
      expect(resumeResult.result).toBeOk(Cl.bool(true));
      
      const streamStatus = simnet.callReadOnlyFn(
        "stream",
        "get-stream-status",
        [Cl.uint(0)],
        sender
      );
      
      const statusResult = cvToValue(streamStatus.result);
      // get-stream-status returns (ok (response uint uint)), so we need to unwrap twice
      const status = statusResult.value?.value !== undefined ? statusResult.value.value : (statusResult.value !== undefined ? statusResult.value : statusResult);
      expect(Number(status)).toBe(0); // STATUS_ACTIVE = 0
    });

    it("should not accumulate tokens while paused", () => {
      // Pause the stream - this sets pause-block to current block height
      simnet.callPublicFn("stream", "pause-stream", [Cl.uint(0)], sender);
      
      // Get balance immediately after pausing (should be same or slightly more due to pause-block)
      const balanceAfterPause = simnet.callReadOnlyFn(
        "stream",
        "balance-of",
        [Cl.uint(0), Cl.principal(recipient)],
        recipient
      );
      
      const balanceAfterPauseValue = cvToValue(balanceAfterPause.result);
      const balanceAfterPauseNum = Number(balanceAfterPauseValue.value || balanceAfterPauseValue);
      
      // Mine blocks while paused - balance should not increase
      simnet.mineEmptyBlock();
      simnet.mineEmptyBlock();
      simnet.mineEmptyBlock();
      
      const balanceWhilePaused = simnet.callReadOnlyFn(
        "stream",
        "balance-of",
        [Cl.uint(0), Cl.principal(recipient)],
        recipient
      );
      
      const balanceAfter = cvToValue(balanceWhilePaused.result);
      const balanceAfterNum = Number(balanceAfter.value || balanceAfter);
      
      // Balance should remain the same (or at most equal to balance after pause)
      // The pause should freeze accumulation at the pause-block
      expect(balanceAfterNum).toBe(balanceAfterPauseNum);
    });

    it("should resume token accumulation after resume", () => {
      simnet.callPublicFn("stream", "pause-stream", [Cl.uint(0)], sender);
      simnet.mineEmptyBlock();
      simnet.callPublicFn("stream", "resume-stream", [Cl.uint(0)], sender);
      
      simnet.mineEmptyBlock();
      simnet.mineEmptyBlock();
      
      const balanceAfterResume = simnet.callReadOnlyFn(
        "stream",
        "balance-of",
        [Cl.uint(0), Cl.principal(recipient)],
        recipient
      );
      
      const balance = cvToValue(balanceAfterResume.result);
      expect(Number(balance)).toBeGreaterThan(0);
    });

    it("should cancel stream and refund unused tokens", () => {
      const cancelResult = simnet.callPublicFn(
        "stream",
        "cancel-stream",
        [Cl.uint(0)],
        sender
      );
      
      expect(cancelResult.result).toBeOk(Cl.uint(1));
      
      const streamStatus = simnet.callReadOnlyFn(
        "stream",
        "get-stream-status",
        [Cl.uint(0)],
        sender
      );
      
      const statusResult = cvToValue(streamStatus.result);
      // get-stream-status returns (ok (response uint uint)), so we need to unwrap twice
      const status = statusResult.value?.value !== undefined ? statusResult.value.value : (statusResult.value !== undefined ? statusResult.value : statusResult);
      expect(Number(status)).toBe(2); // STATUS_CANCELLED = 2
      
      expect(cancelResult.events[0].event).toBe("stx_transfer_event");
    });

    it("should prevent withdrawal from cancelled stream", () => {
      simnet.callPublicFn("stream", "cancel-stream", [Cl.uint(0)], sender);
      
      const withdrawResult = simnet.callPublicFn(
        "stream",
        "withdraw",
        [Cl.uint(0)],
        recipient
      );
      
      expect(withdrawResult.result).toBeErr(Cl.uint(6)); // ERR_STREAM_CANCELLED
    });
  });
});
