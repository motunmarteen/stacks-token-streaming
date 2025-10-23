
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
      })
    );
  });
});
