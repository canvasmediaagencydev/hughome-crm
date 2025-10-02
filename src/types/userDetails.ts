// User details type definitions
import { User } from './user'
import { Transaction, TransactionPagination } from './transaction'
import { Redemption, RedemptionPagination } from './redemption'

export interface UserDetails {
  user: User
  transactions: Transaction[]
  transactionPagination: TransactionPagination
  redemptions: Redemption[]
  redemptionPagination: RedemptionPagination
}
